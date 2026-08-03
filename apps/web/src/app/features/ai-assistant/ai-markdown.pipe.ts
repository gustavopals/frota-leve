import { Pipe } from '@angular/core';
import type { PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'aiMarkdown',
})
export class AiMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const markdown = value?.trim() ?? '';

    if (!markdown) {
      return '';
    }

    return marked.parse(markdown, {
      async: false,
      breaks: true,
      gfm: true,
    });
  }
}
