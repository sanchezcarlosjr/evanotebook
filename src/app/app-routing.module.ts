import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '', loadChildren: () => import('./notebook/notebook.module').then(m => m.NotebookModule)
  },
  { path: '**', pathMatch: 'full', loadChildren: () => import('./notebook/notebook.module').then(m => m.NotebookModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking'
})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
