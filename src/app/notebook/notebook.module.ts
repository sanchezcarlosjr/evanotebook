import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotebookRoutingModule } from './notebook-routing.module';
import { NotebookComponent } from './notebook.component';
import {JsonFormsModule} from "@jsonforms/angular";
import { FormComponent } from './form/form.component';
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {MatRadioModule} from "@angular/material/radio";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import { JsonFormsAngularMaterialModule } from '@jsonforms/angular-material';
import {MatMenuModule} from "@angular/material/menu";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatIconModule} from "@angular/material/icon";

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
    MatToolbarModule,
    MatMenuModule,
    MatButtonModule,
    MatRadioModule,
    MatSnackBarModule
]
})
export class NotebookModule { }
