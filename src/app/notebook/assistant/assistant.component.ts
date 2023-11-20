import { Component } from '@angular/core';

@Component({
  selector: 'app-assistant',
  templateUrl: './assistant.component.html',
  styleUrls: ['./assistant.component.css']
})
export class AssistantComponent {
  showChatbot = false;
  toggleChatbot() {
    this.showChatbot = !this.showChatbot;
  }
}
