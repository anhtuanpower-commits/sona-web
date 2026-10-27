// Áp thay đổi lên danh sách mới nhất, chặn ghi đè nội dung đã đổi ở phiên khác.
function conflict(message) {
  const error = new Error(message + " Tải lại trang để lấy bản mới nhất rồi sửa lại.");
  error.status = 409;
  throw error;
}

function currentIndex(list, original) {
  const index = list.findIndex(x => x.slug === original.slug);
  if (index < 0) conflict("Nội dung này đã bị xóa hoặc đổi đường dẫn ở nơi khác.");
  if (JSON.stringify(list[index]) !== JSON.stringify(original))
    conflict("Nội dung này vừa được sửa ở nơi khác. Chưa ghi đè thay đổi đó.");
  return index;
}

export const upsert = (original, item) => list => {
  const index = original ? currentIndex(list, original) : -1;
  if (list.some((x, i) => x.slug === item.slug && i !== index))
    conflict(`Đường dẫn "${item.slug}" vừa được nội dung khác dùng.`);
  if (index >= 0) list[index] = item;
  else list.push(item);
  return list;
};

export const removeBy = original => list => {
  const index = currentIndex(list, original);
  return list.filter((_, i) => i !== index);
};
