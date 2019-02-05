import { Observable, Subject } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { Injectable, ElementRef, NgZone } from '@angular/core';
import { MutatonRecordFilter } from './ngx-typeahead.interface';
import { containsPlainTextNode, isPlainTextNode, isCommentNode } from './helpers';

@Injectable()
export class NgxTypeaheadService {
  private mutationObserver: MutationObserver;
  private mutations$: Subject<MutationRecord[]> = new Subject();

  constructor(elRef: ElementRef, private ngZone: NgZone) {
    this.mutationObserver = new MutationObserver(this.handleObserverChanges.bind(this));
    this.mutationObserver.observe(elRef.nativeElement, { subtree: true, characterData: true });
  }

  public observeTextNode(): Observable<MutationRecord[]> {
    return this.mutations$.pipe(
      map(changes => this.passIfSomeOk(changes, [this.isAddingTextNode, this.isChangingTextNodeContent])),
      filter(changes => changes && changes.length > 0)
    );
  }

  public passIfSomeOk(changes: MutationRecord[], filters?: MutatonRecordFilter[]): MutationRecord[] {
    return changes.filter(change => !filters || filter.length === 0 || filters.some(fn => fn.call(this, change)));
  }

  public disconnect(): void {
    this.mutationObserver.disconnect();
  }

  private handleObserverChanges(changes: MutationRecord[]): void {
    this.ngZone.runOutsideAngular(() => this.mutations$.next(changes));
  }

  // filters
  private isAddingTextNode(change: MutationRecord): boolean {
    return change.type === 'childList' && containsPlainTextNode(change.addedNodes);
  }

  private isChangingTextNodeContent(change: MutationRecord): boolean {
    return change.type === 'characterData' && (isPlainTextNode(change.target) || isCommentNode(change.target));
  }
}
