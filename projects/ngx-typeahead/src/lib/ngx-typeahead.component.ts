import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, tap, distinctUntilChanged } from 'rxjs/operators';
import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnChanges,
  ViewChild,
  SimpleChanges,
  ElementRef,
  HostListener,
  HostBinding,
  forwardRef,
  OnDestroy,
  ViewEncapsulation,
  Output,
  OnInit,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgxTypeaheadService } from './ngx-typeahead.service';
import { getPlainTextNode } from './helpers';

export const TYPEAHEAD_CONTROL_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgxTypeaheadComponent),
  multi: true,
};

@Component({
  selector: 'ngx-typeahead',
  template: `
    <span #typeahead class="ngx-typeahead-content" *ngIf="(focused$ | async)">{{ typeahead$ | async }}</span>
  `,
  styles: [
    `
      :host {
        cursor: text;
      }
      :host(:empty:not(:focus)::before) {
        content: attr(placeholder);
      }
      .ngx-typeahead-content {
        color: gray;
      }
    `,
  ],
  providers: [TYPEAHEAD_CONTROL_VALUE_ACCESSOR, NgxTypeaheadService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NgxTypeaheadComponent<S> implements OnDestroy, OnChanges, ControlValueAccessor {
  /**
   * Allow line breaks
   */
  @Input() public multiline: boolean = false;

  /**
   * The list of suggestions.
   */
  @Input() public suggestions: S[] = [];

  /**
   * The input placeholder.
   */
  @HostBinding('attr.placeholder') @Input() public placeholder: string;

  /**
   * The list of keys which will apply suggestion
   */
  @Input() public applyingKeys: string[] = ['Tab', 'Enter'];

  /**
   * The part separator
   */
  @Input() public partSeparator: string = ' ';

  /**
   * The property of a list item that should be used for matching.
   */
  @Input() public searchProperty: string = 'title';

  /**
   * The property of a list item that should be displayed.
   */
  @Input() public displayProperty: string = this.searchProperty;

  /**
   * The stream of focus changes
   */
  @Output()
  public focused$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  /**
   * The stream of content elements.
   */
  public input$: Observable<string> = this.service.observeTextNode().pipe(
    map(() => this.plainText),
    distinctUntilChanged()
  );

  /**
   * The stream ahead part.
   */
  public typeahead$: Observable<string | null> = this.input$.pipe(
    tap(() => this.normalizeNodesSequense()),
    map(input => this.getTypeahead(input))
  );

  private maxWordsInSuggestionCount: number;
  private destroy$: Subject<void> = new Subject();

  @ViewChild('typeahead') typeaheadElRef: ElementRef<HTMLSpanElement>;

  @HostBinding('attr.contenteditable') get contenteditable() {
    return 'true';
  }

  @HostListener('keydown', ['$event'])
  public handleKeyUp(e: KeyboardEvent): void {
    e.preventDefault();
  }

  @HostListener('keydown', ['$event'])
  public handleKeyDown(e: KeyboardEvent): void {
    const selection = window.getSelection();
    const withControl = (e.metaKey && navigator.platform === 'MacIntel') || e.ctrlKey;

    // prevent caret on ahead text move/remove
    if (this.isRightmostSelection(selection) && (e.key === 'ArrowRight' || e.key === 'Delete')) {
      e.preventDefault();
    }

    if (withControl && (e.key === 'ArrowRight' || e.key === 'Delete')) {
      e.preventDefault();
      this.moveCaretRightmost();
    }

    // prevent line breaks
    if (e.key === 'Enter' && !this.multiline) {
      e.preventDefault();
    }

    if (this.applyingKeys.includes(e.key) && this.typeaheadContent) {
      e.preventDefault();

      const ok = this.applySuggestion();

      if (ok) {
        e.stopPropagation();
      }
    }

    if ((this.plainText.length <= 1 || withControl) && e.key === 'Backspace') {
      e.preventDefault();

      if (this.plainText.length === 1 || withControl) {
        this.plainText = '';
      }
    }

    /**
     * handle IE 11 contenteditable behavior
     */
    if (e.key.length === 1 && !withControl) {
      e.preventDefault();
      this.plainText += e.key;
      this.moveCaretRightmost();
    }
  }

  @HostListener('click')
  public handleClick(): void {
    const selection = window.getSelection();

    if (this.isTypeaheadNode(selection.focusNode)) {
      this.moveCaretRightmost();
    }

    this.onTouchedCallback();
  }

  /**
   * IE 11 doesn't have ClipboardEvent constructor
   * @param e ClipboardEvent
   */
  @HostListener('paste', ['$event'])
  public handlePaste(e: any): void {
    if (e.clipboardData.types.includes('text/html')) {
      e.preventDefault();
    }
  }

  /**
   * Safari doesn't have DragEvent constructor
   * @param e DragEvent
   */
  @HostListener('dragover', ['$event'])
  @HostListener('dragenter', ['$event'])
  public handleDrag(e: any): void {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  }

  @HostListener('focus')
  public handleFocus() {
    this.focused$.next(true);
  }

  @HostListener('blur')
  public handleBlur() {
    this.focused$.next(false);
  }

  private get typeaheadContent(): string | null {
    return this.typeaheadElRef && this.typeaheadElRef.nativeElement.textContent;
  }

  private get textNode(): Node | null {
    return this.elRef && getPlainTextNode(this.elRef.nativeElement.childNodes);
  }

  private get plainText(): string {
    const node = this.textNode;

    return (node && node.textContent) || '';
  }

  private set plainText(v: string) {
    const el = this.elRef.nativeElement;
    let textNode = this.textNode;

    if (textNode) {
      textNode.textContent = v;
    } else {
      textNode = document.createTextNode(v);

      el.lastChild ? el.insertBefore(textNode, el.lastChild) : el.appendChild(textNode);
    }

    this.onChangeCallback(v);
  }

  constructor(private elRef: ElementRef<HTMLDivElement>, private service: NgxTypeaheadService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const suggestions = changes.suggestions && changes.suggestions.currentValue;

    if (suggestions) {
      this.maxWordsInSuggestionCount = this.getGreatesWordsAmount(suggestions);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.service.disconnect();
  }

  // -------------------- Control Value Accessor --------------------

  /**
   * Placeholder for a callback which is later provided by the Control Value Accessor.
   */
  private onTouchedCallback: () => void = () => {};

  /**
   * Placeholder for a callback which is later provided by the Control Value Accessor.
   */
  private onChangeCallback: (_: any) => void = () => {};

  public writeValue(v: string | null) {
    if (v == null) {
      return;
    }

    this.plainText = v;
  }

  public registerOnChange(fn: any) {
    this.onChangeCallback = fn;
  }

  public registerOnTouched(fn: any) {
    this.onTouchedCallback = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.elRef.nativeElement.setAttribute('disabled', '');
    } else {
      this.elRef.nativeElement.removeAttribute('disabled');
    }
  }

  // -------------------- Control Value Accessor --------------------

  /**
   * Return suggestion completion
   */
  public getTypeahead(input: string = this.plainText): string {
    if (!input) {
      return '';
    }

    const chunks = input.split(this.partSeparator);

    let chunk: string;
    let suggestion: S;

    for (let i = 0; i < this.maxWordsInSuggestionCount; i++) {
      chunk = chunks.join(' ');
      suggestion = this.getSuggestion(chunk);

      if (suggestion) {
        break;
      }
    }

    if (
      document.activeElement !== this.elRef.nativeElement ||
      !suggestion ||
      chunk.length === suggestion[this.displayProperty]
    ) {
      return '';
    }

    return this.getDisplayValue(suggestion).substr(chunk.length);
  }

  private isTypeaheadNode(node: Node): boolean {
    return this.typeaheadElRef && node === this.typeaheadElRef.nativeElement.firstChild;
  }

  private isRightmostSelection(selection: Selection): boolean {
    return selection.focusNode.textContent.length === selection.focusOffset;
  }

  /**
   * Return appropriate suggestion or null
   */
  private getSuggestion(text: string): S | null {
    return (
      text &&
      this.suggestions.find(item =>
        this.getSearchValue(item)
          .toLowerCase()
          .startsWith(text.toLowerCase())
      )
    );
  }

  private getSearchValue(item: S): string {
    try {
      return typeof item === 'string' ? item : item[this.searchProperty];
    } catch (e) {
      throw Error(`Suggestion should be string or contains searchProperty. You can set it as Input [searchProperty].`);
    }
  }

  private getDisplayValue(item: S): string {
    try {
      return typeof item === 'string' ? item : item[this.displayProperty];
    } catch (e) {
      throw Error(
        `Suggestion should be string or contains displayProperty. You can set it as Input [displayProperty].`
      );
    }
  }

  /**
   * Replace text content part and ahead text on suggestion
   */
  private applySuggestion(): boolean {
    const typeahead = this.getTypeahead(this.plainText);

    if (!typeahead) {
      return false;
    }

    this.plainText = this.plainText + typeahead;
    this.moveCaretRightmost();

    return true;
  }

  /**
   * Move caret to text content
   */
  private moveCaretRightmost(): void {
    const selection = window.getSelection();
    const textLength = this.plainText.length;

    selection.collapse(this.textNode, textLength);
  }

  private getGreatesWordsAmount(items: S[]): number {
    return items.reduce((result, item) => {
      const count = this.getSearchValue(item).split(this.partSeparator).length;

      return count > result ? count : result;
    }, 0);
  }

  private normalizeNodesSequense(): void {
    const el = this.elRef.nativeElement;
    const nodes = el.childNodes;
    const textNode = getPlainTextNode(nodes);
    const typeaheadEl = this.typeaheadElRef.nativeElement;

    const arrayOfNodes: Node[] = Array.from(nodes);
    const indexOfTextNode = arrayOfNodes.indexOf(textNode);
    const indexOfTypeahead = arrayOfNodes.indexOf(typeaheadEl);

    if (indexOfTypeahead > -1 && indexOfTextNode > indexOfTypeahead) {
      el.insertBefore(textNode, typeaheadEl);
    }
  }
}
