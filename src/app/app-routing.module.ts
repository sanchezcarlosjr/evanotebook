import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {P2PComponent} from "./p2p/p2p.component";

const routes: Routes = [
  {
    path: '', loadChildren: () => import('./notebook/notebook.module').then(m => m.NotebookModule)
  },
  {
    path: 'p2p',
    component: P2PComponent
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
