/**
 * Chữ viết tắt cho ô avatar: chữ đầu của họ + chữ đầu của tên.
 * "Nguyễn Văn Thử" -> "NT"; chỉ có một từ thì lấy tối đa hai chữ cái đầu.
 */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Tên gọi thân mật: người Việt gọi bằng từ cuối của họ tên ("Nguyễn Văn Thử" -> "Thử") */
export function getGivenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words.at(-1) ?? fullName;
}
