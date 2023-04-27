import { Injectable } from '@angular/core';
import {BehaviorSubject, filter} from "rxjs";
import {Title} from "@angular/platform-browser";

@Injectable({
  providedIn: 'root'
})
export class TitleSubjectService {
  private behaviorSubject = new BehaviorSubject<string>("");
  constructor(private title: Title) {}
  setTitle(title: string) {
    this.title.setTitle(title);
    this.behaviorSubject.next(title);
    return title;
  }
  getTitle() {
    return this.title.getTitle();
  }
  get$() {
    return this.behaviorSubject.asObservable().pipe(
      filter(x => x !== "")
    );
  }
}
