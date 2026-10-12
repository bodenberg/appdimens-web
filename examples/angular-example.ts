// Angular 16+ (standalone) — main.ts: bootstrapApplication(AppComponent, { providers: [provideWebDimens()] })
import { Component } from '@angular/core';
import { sdp, ssp } from 'webdimens';
import { injectDimen } from 'webdimens/angular';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <section [style.padding.px]="pad()">
      <h2 [style.font-size.px]="title()">Hello</h2>
      <p class="body">CSS tokens work in component styles too.</p>
    </section>
  `,
  styles: [`.body { font-size: calc(14 * var(--ssp)); }`],
})
export class CardComponent {
  pad = injectDimen(() => sdp(16));
  title = injectDimen(() => ssp(20));
}
