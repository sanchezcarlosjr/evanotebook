import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotebookRoutingModule } from './notebook-routing.module';
import { NotebookComponent } from './notebook.component';
import {JsonFormsModule} from "@jsonforms/angular";
import { FormComponent } from './form/form.component';
import {MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER} from "@angular/material/tooltip";
import {MAT_SELECT_SCROLL_STRATEGY_PROVIDER} from "@angular/material/select";
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {MatRadioModule} from "@angular/material/radio";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import { JsonFormsAngularMaterialModule } from '@jsonforms/angular-material';

@NgModule({
  declarations: [
    NotebookComponent,
    FormComponent
  ],
  imports: [
    CommonModule,
    NotebookRoutingModule,
    JsonFormsModule,
    JsonFormsAngularMaterialModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatRadioModule,
    MatSnackBarModule
]
})
export class NotebookModule { }
