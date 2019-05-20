import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxTypeaheadComponent } from './ngx-typeahead.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [NgxTypeaheadComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  exports: [NgxTypeaheadComponent]
})
export class NgxTypeaheadModule { }
