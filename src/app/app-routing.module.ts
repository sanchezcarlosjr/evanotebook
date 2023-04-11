import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '', loadChildren: () => import('./notebook/notebook.module').then(m => m.NotebookModule)
  },
  { path: 'docs', loadChildren: () => import('./documentation/documentation.module').then(m => m.DocumentationModule) },
  { path: '**', pathMatch: 'full', loadChildren: () => import('./notebook/notebook.module').then(m => m.NotebookModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking'
})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
