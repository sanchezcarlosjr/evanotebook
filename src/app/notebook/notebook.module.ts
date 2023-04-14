import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {NotebookRoutingModule} from './notebook-routing.module';
import {NotebookComponent} from './notebook.component';
import {JsonFormsModule} from "@jsonforms/angular";
import {FormComponent} from './form/form.component';
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatButtonModule} from "@angular/material/button";
import {MatRadioModule} from "@angular/material/radio";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {JsonFormsAngularMaterialModule} from '@jsonforms/angular-material';
import {MatMenuModule} from "@angular/material/menu";
import {MatToolbarModule} from "@angular/material/toolbar";
import {FormsModule} from "@angular/forms";
import { TableComponent } from './table/table.component';
import {MatTableModule} from "@angular/material/table";
import {MatSortModule} from "@angular/material/sort";
import {MatPaginatorModule} from "@angular/material/paginator";

@NgModule({
  declarations: [
    NotebookComponent,
    FormComponent,
    TableComponent
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
    MatSnackBarModule,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule
  ]
})
export class NotebookModule {
}
