import { Subject, BehaviorSubject } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnChanges,
  ViewChild,
  SimpleChanges,
  ElementRef,
  forwardRef,
  OnDestroy,
  ViewEncapsulation,
  Output,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';

export const TYPEAHEAD_CONTROL_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgxTypeaheadComponent),
  multi: true,
};

@Component({
  selector: 'ngx-typeahead',
  template: `
    <div class="ngx-typeahead">
      <input
        #plainText
        type="text"
        class="ngx-plain-content text"
        [placeholder]="placeholder"
        [formControl]="plainTextControl"
        (focus)="typeahead.hidden = false"
        (blur)="typeahead.hidden = false"
        (keydown)="handleKeyDown($event)"
      />
      <p #typeahead class="ngx-typeahead-content">
        <ng-container *ngIf="typeaheadContent">
          <span style="visibility: hidden" class="text">{{ typeaheadContent[0] }}</span
          ><span class="text">{{ typeaheadContent[1] }}</span>
        </ng-container>
      </p>
    </div>
  `,
  styles: [
    `
      .ngx-typeahead {
        position: relative;
        width: 100%;
        height: 100%;
        cursor: text;
      }
      .text {
        line-height: 36px;
        height: 36px;
        font-size: 2.2em;
      }
      .ngx-plain-content {
        width: 400px;
        white-space: nowrap;
        overflow: hidden;
        outline: none;
        -webkit-appearance: none;
        padding: 8px 8px;
      }
      .ngx-typeahead-content {
        position: absolute;
        color: gray;
        left: 9px;
        top: 9px;
        margin: 0;
      }
    `,
  ],
  providers: [TYPEAHEAD_CONTROL_VALUE_ACCESSOR],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NgxTypeaheadComponent<S> implements OnInit, OnDestroy, OnChanges, ControlValueAccessor {
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
  @Input() public placeholder: string;

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

  @ViewChild('plainText') plainTextElRef: ElementRef<HTMLInputElement>;

  public plainTextControl: FormControl = new FormControl('');
  public typeaheadContent: [string, string] | null = null;

  private maxWordsInSuggestionCount: number;
  private destroy$: Subject<void> = new Subject();

  constructor(private cdRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.plainTextControl.valueChanges
      .pipe(
        startWith(this.plainTextControl.value),
        takeUntil(this.destroy$)
      )
      .subscribe(text => this.setWithChangeDetection({ typeaheadContent: this.getTypeahead(text) }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const suggestions = changes.suggestions && changes.suggestions.currentValue;

    if (suggestions) {
      this.maxWordsInSuggestionCount = this.getGreatesWordsAmount(suggestions);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public handleKeyDown(e: KeyboardEvent): void {
    if (this.applyingKeys.includes(e.key) && this.typeaheadContent) {
      e.preventDefault();

      const ok = this.applySuggestion();

      if (ok) {
        e.stopPropagation();
      }
    }
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

    this.plainTextControl.setValue(v);
  }

  public registerOnChange(fn: any) {
    this.onChangeCallback = v => {
      fn(v);
      console.log(v);
    };
  }

  public registerOnTouched(fn: any) {
    this.onTouchedCallback = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.plainTextControl.disable();
    } else {
      this.plainTextControl.enable();
    }
  }

  // -------------------- Control Value Accessor --------------------

  /**
   * Return suggestion completion
   */
  public getTypeahead(input?: string | null): [string, string] | null {
    if (!input) {
      return null;
    }

    const chunks = input.split(this.partSeparator);

    let chunk: string;
    let suggestion: S;

    for (let i = 1; i <= this.maxWordsInSuggestionCount; i++) {
      chunk = chunks.slice(chunks.length - i).join(' ');
      suggestion = this.getSuggestion(chunk);

      if (suggestion) {
        break;
      }
    }

    if (
      document.activeElement !== this.plainTextElRef.nativeElement ||
      !suggestion ||
      chunk.length === suggestion[this.displayProperty]
    ) {
      return null;
    }

    const displayValue = this.getDisplayValue(suggestion);

    return [input.substr(0, input.length), displayValue.substr(chunk.length)];
  }

  /**
   * Return appropriate suggestion or null
   */
  private getSuggestion(text: string): S | null {
    const query = text.replace(/\s/g, () => ' ');

    if (!query) {
      return null;
    }

    try {
      const searchRegExp = new RegExp(`^${query}.*`, 'i');

      return this.suggestions.find(item => searchRegExp.test(this.getSearchValue(item))) || null;
    } catch (e) {
      return null;
    }
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
    const plainText = this.plainTextControl.value;
    const typeahead = this.getTypeahead(plainText);

    if (!typeahead) {
      return false;
    }

    this.plainTextControl.setValue(typeahead[0] + typeahead[1]);

    return true;
  }

  private getGreatesWordsAmount(items: S[]): number {
    return items.reduce((result, item) => {
      const count = this.getSearchValue(item).split(this.partSeparator).length;

      return count > result ? count : result;
    }, 0);
  }

  private setWithChangeDetection(data: Partial<NgxTypeaheadComponent<S>>): void {
    Object.assign(this, data);
    this.cdRef.detectChanges();
  }
}
