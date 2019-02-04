export type TextPart = PlainTextPart | TypeaheadTextPart;

export interface PlainTextPart {
  value: string;
}

export interface TypeaheadTextPart {
  relativeNode: Node;
  value: string;
}

export interface TypeaheadState<S> {
  multiline: boolean;
  suggestions: S[];
  applyingKeys: string[];
  partSeparator: string;
  searchProperty: keyof S;
  displayProperty: keyof S;
  suggestion?: S;
}

export interface TypeaheadEvent {
  value: string;
  event: Event;
}

export type MutatonRecordFilter = (change: MutationRecord) => boolean;
export type TypeaheadAction = (event: TypeaheadEvent) => void;
export type TypeaheadKey = 'Backspace' | 'Delete' | 'ArrowRight' | 'Enter' | 'Tab' | string;
