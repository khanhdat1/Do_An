/** Đưa con trỏ vào ô nhập theo `name` — dùng để nhảy tới ô đầu tiên bị lỗi sau khi submit */
export function focusField(form: HTMLFormElement, name: string): void {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLElement) element.focus();
}
