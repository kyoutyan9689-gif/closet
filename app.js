const STORAGE_KEY = "closet-items-v1";
const CATEGORY_STORAGE_KEY = "closet-categories-v1";

const form = document.querySelector("#item-form");
const nameInput = document.querySelector("#item-name");
const quantityInput = document.querySelector("#item-quantity");
const list = document.querySelector("#item-list");
const template = document.querySelector("#item-template");
const totalCount = document.querySelector("#total-count");
const itemKinds = document.querySelector("#item-kinds");
const emptyState = document.querySelector("#empty-state");
const emptyMessage = document.querySelector("#empty-message");
const categoryForm = document.querySelector("#category-form");
const categoryNameInput = document.querySelector("#category-name");
const categoryFilters = document.querySelector("#category-filters");
const categoryManagement = document.querySelector("#category-management");
const addCategoryOptions = document.querySelector("#add-category-options");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editNameInput = document.querySelector("#edit-name");
const editCategoryOptions = document.querySelector("#edit-category-options");
const copyBackupButton = document.querySelector("#copy-backup");
const loadBackupButton = document.querySelector("#load-backup");
const backupInput = document.querySelector("#backup-input");
const backupStatus = document.querySelector("#backup-status");
const restoreDialog = document.querySelector("#restore-dialog");
const restoreItemCount = document.querySelector("#restore-item-count");
const restoreCategoryCount = document.querySelector("#restore-category-count");

let categories = loadCategories();
let items = loadItems();
let activeCategoryId = null;
let editingItemId = null;
let pendingBackup = null;

function loadCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY));
    if (!Array.isArray(stored)) return [];
    return stored.filter((category) =>
      typeof category.id === "string" && typeof category.name === "string" && category.name.trim()
    );
  } catch {
    return [];
  }
}

function loadItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item) =>
        typeof item.id === "string" && typeof item.name === "string" && Number.isInteger(item.quantity) && item.quantity >= 0
      )
      .map((item) => ({
        ...item,
        categoryIds: Array.isArray(item.categoryIds)
          ? [...new Set(item.categoryIds.filter((id) => typeof id === "string"))]
          : []
      }));
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function saveCategories() {
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
}

function createBackupJson() {
  return JSON.stringify({
    format: "closet-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    categories
  }, null, 2);
}

function showBackupStatus(message, isError = false) {
  backupStatus.textContent = message;
  backupStatus.classList.toggle("is-error", isError);
}

async function copyText(textToCopy) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return;
    } catch {
      // Fall through to the selection-based method used by older Safari versions.
    }
  }

  // Older iOS/Safari versions need a selected, editable element for execCommand.
  const temporaryInput = document.createElement("textarea");
  temporaryInput.value = textToCopy;
  temporaryInput.setAttribute("readonly", "");
  temporaryInput.style.position = "fixed";
  temporaryInput.style.inset = "0";
  temporaryInput.style.opacity = "0";
  document.body.append(temporaryInput);
  temporaryInput.select();
  temporaryInput.setSelectionRange(0, temporaryInput.value.length);
  const copied = document.execCommand("copy");
  temporaryInput.remove();
  if (!copied) throw new Error("copy failed");
}

function parseBackup(input) {
  let backup;
  try {
    backup = JSON.parse(input);
  } catch {
    throw new Error("JSONの形式が正しくありません。コピーした内容を確認してください。");
  }

  if (!backup || backup.format !== "closet-backup" || backup.version !== 1
      || !Array.isArray(backup.items) || !Array.isArray(backup.categories)) {
    throw new Error("このアプリのバックアップとして認識できません。");
  }

  const validCategories = backup.categories.every((category) =>
    category && typeof category.id === "string" && typeof category.name === "string" && category.name.trim()
  );
  const validItems = backup.items.every((item) =>
    item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim()
      && Number.isSafeInteger(item.quantity) && item.quantity >= 0
      && Array.isArray(item.categoryIds) && item.categoryIds.every((id) => typeof id === "string")
  );
  if (!validCategories || !validItems) {
    throw new Error("バックアップのデータが壊れているため読み込めません。");
  }

  return {
    categories: backup.categories.map(({ id, name }) => ({ id, name })),
    items: backup.items.map(({ id, name, quantity, categoryIds }) => ({
      id,
      name,
      quantity,
      categoryIds: [...new Set(categoryIds)]
    }))
  };
}

function restoreBackup(backup) {
  const previousItems = localStorage.getItem(STORAGE_KEY);
  const previousCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(backup.categories));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.items));
  } catch (error) {
    if (previousCategories === null) localStorage.removeItem(CATEGORY_STORAGE_KEY);
    else localStorage.setItem(CATEGORY_STORAGE_KEY, previousCategories);
    if (previousItems === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, previousItems);
    throw error;
  }

  categories = backup.categories;
  items = backup.items;
  activeCategoryId = null;
  render();
}

function createChip(category, { selected = false, selectable = false } = {}) {
  const chip = document.createElement(selectable ? "button" : "span");
  chip.className = `chip${selected ? " is-selected" : ""}`;
  chip.textContent = category.name;
  if (selectable) {
    chip.type = "button";
    chip.dataset.categoryId = category.id;
    chip.setAttribute("aria-pressed", String(selected));
  }
  return chip;
}

function renderCategoryPicker(container, selectedIds = []) {
  container.replaceChildren();
  if (!categories.length) {
    const hint = document.createElement("span");
    hint.className = "category-hint";
    hint.textContent = "先にカテゴリを作成すると選択できます";
    container.append(hint);
    return;
  }
  categories.forEach((category) => {
    const chip = createChip(category, { selected: selectedIds.includes(category.id), selectable: true });
    chip.addEventListener("click", () => {
      const selected = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", String(selected));
      chip.classList.toggle("is-selected", selected);
    });
    container.append(chip);
  });
}

function selectedCategoryIds(container) {
  return [...container.querySelectorAll('[aria-pressed="true"]')].map((chip) => chip.dataset.categoryId);
}

function renderCategories() {
  // Creating a category should not discard choices already made in the add form.
  const selectedAddCategoryIds = selectedCategoryIds(addCategoryOptions);
  categoryFilters.replaceChildren();
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `chip${activeCategoryId === null ? " is-selected" : ""}`;
  allButton.textContent = "すべて";
  allButton.setAttribute("aria-pressed", String(activeCategoryId === null));
  allButton.addEventListener("click", () => setActiveCategory(null));
  categoryFilters.append(allButton);

  categories.forEach((category) => {
    const chip = createChip(category, { selected: category.id === activeCategoryId, selectable: true });
    chip.addEventListener("click", () => setActiveCategory(category.id));
    categoryFilters.append(chip);
  });

  categoryManagement.replaceChildren();
  categories.forEach((category) => {
    const row = document.createElement("span");
    row.className = "manage-chip";
    row.append(createChip(category));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `カテゴリ「${category.name}」を削除`);
    remove.addEventListener("click", () => deleteCategory(category.id));
    row.append(remove);
    categoryManagement.append(row);
  });

  renderCategoryPicker(addCategoryOptions, selectedAddCategoryIds);
}

function setActiveCategory(id) {
  activeCategoryId = id;
  renderCategories();
  renderItems();
}

function renderItems() {
  list.replaceChildren();
  const visibleItems = activeCategoryId === null
    ? items
    : items.filter((item) => item.categoryIds.includes(activeCategoryId));

  visibleItems.forEach((item) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const name = card.querySelector(".item-name");
    const categoryList = card.querySelector(".item-categories");
    const count = card.querySelector(".item-count");
    const decrease = card.querySelector(".decrease");
    const increase = card.querySelector(".increase");
    const editButton = card.querySelector(".edit-button");
    const deleteButton = card.querySelector(".delete-button");

    name.textContent = item.name;
    item.categoryIds.forEach((id) => {
      const category = categories.find((candidate) => candidate.id === id);
      if (category) categoryList.append(createChip(category));
    });
    count.textContent = item.quantity;
    count.setAttribute("aria-label", `${item.name}は${item.quantity}点`);
    decrease.disabled = item.quantity === 0;
    decrease.setAttribute("aria-label", `${item.name}を1つ減らす`);
    increase.setAttribute("aria-label", `${item.name}を1つ増やす`);
    editButton.setAttribute("aria-label", `${item.name}を編集`);
    deleteButton.setAttribute("aria-label", `${item.name}を削除`);

    decrease.addEventListener("click", () => changeQuantity(item.id, -1));
    increase.addEventListener("click", () => changeQuantity(item.id, 1));
    editButton.addEventListener("click", () => openEditDialog(item.id));
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    list.append(card);
  });

  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  totalCount.textContent = total.toLocaleString("ja-JP");
  itemKinds.textContent = activeCategoryId === null
    ? `${items.length}種類`
    : `${visibleItems.length}種類 / 全${items.length}種類`;
  emptyState.hidden = visibleItems.length > 0;
  emptyMessage.textContent = items.length ? "別のカテゴリを選択してください" : "";
}

function render() {
  renderCategories();
  renderItems();
}

function changeQuantity(id, amount) {
  items = items.map((item) => item.id === id
    ? { ...item, quantity: Math.max(0, item.quantity + amount) }
    : item
  );
  saveItems();
  renderItems();
}

function deleteItem(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item || !window.confirm(`「${item.name}」を削除しますか？`)) return;
  items = items.filter((candidate) => candidate.id !== id);
  saveItems();
  renderItems();
}

function deleteCategory(id) {
  const category = categories.find((candidate) => candidate.id === id);
  if (!category || !window.confirm(`カテゴリ「${category.name}」を削除しますか？\nアイテムは削除されません。`)) return;
  categories = categories.filter((candidate) => candidate.id !== id);
  items = items.map((item) => ({ ...item, categoryIds: item.categoryIds.filter((categoryId) => categoryId !== id) }));
  if (activeCategoryId === id) activeCategoryId = null;
  saveCategories();
  saveItems();
  render();
}

function openEditDialog(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  editingItemId = id;
  editNameInput.value = item.name;
  renderCategoryPicker(editCategoryOptions, item.categoryIds);
  editDialog.showModal();
  editNameInput.focus();
  editNameInput.select();
}

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryNameInput.value.trim();
  if (!name) return;
  if (categories.some((category) => category.name.localeCompare(name, "ja", { sensitivity: "base" }) === 0)) {
    categoryNameInput.setCustomValidity("同じ名前のカテゴリがあります");
    categoryNameInput.reportValidity();
    return;
  }
  categoryNameInput.setCustomValidity("");
  categories.push({ id: crypto.randomUUID(), name });
  saveCategories();
  categoryForm.reset();
  renderCategories();
});

categoryNameInput.addEventListener("input", () => categoryNameInput.setCustomValidity(""));

document.querySelector("#edit-close").addEventListener("click", () => editDialog.close());
editDialog.addEventListener("click", (event) => {
  if (event.target === editDialog) editDialog.close();
});
editDialog.addEventListener("close", () => {
  editingItemId = null;
});

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = editNameInput.value.trim();
  if (!name || !editingItemId) return;
  items = items.map((item) => item.id === editingItemId
    ? { ...item, name, categoryIds: selectedCategoryIds(editCategoryOptions) }
    : item
  );
  saveItems();
  editDialog.close();
  renderItems();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const quantity = Number.parseInt(quantityInput.value, 10);
  if (!name || !Number.isInteger(quantity) || quantity < 1) return;
  const categoryIds = selectedCategoryIds(addCategoryOptions);

  const existingIndex = items.findIndex((item) => item.name.localeCompare(name, "ja", { sensitivity: "base" }) === 0);
  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    items.splice(existingIndex, 1);
    items.unshift({
      ...existing,
      quantity: existing.quantity + quantity,
      categoryIds: [...new Set([...existing.categoryIds, ...categoryIds])]
    });
  } else {
    items.unshift({ id: crypto.randomUUID(), name, quantity, categoryIds });
  }

  saveItems();
  form.reset();
  quantityInput.value = "1";
  render();
  nameInput.focus();
});

copyBackupButton.addEventListener("click", async () => {
  try {
    await copyText(createBackupJson());
    showBackupStatus("バックアップをコピーしました。移行先の入力欄に貼り付けてください。");
  } catch {
    showBackupStatus("コピーできませんでした。Safariの設定を確認して、もう一度お試しください。", true);
  }
});

backupInput.addEventListener("input", () => showBackupStatus(""));

loadBackupButton.addEventListener("click", () => {
  try {
    pendingBackup = parseBackup(backupInput.value.trim());
  } catch (error) {
    pendingBackup = null;
    showBackupStatus(error.message, true);
    backupInput.focus();
    return;
  }

  restoreItemCount.textContent = `${pendingBackup.items.length}種類`;
  restoreCategoryCount.textContent = `${pendingBackup.categories.length}件`;
  restoreDialog.showModal();
});

function closeRestoreDialog() {
  pendingBackup = null;
  restoreDialog.close();
}

document.querySelector("#restore-close").addEventListener("click", closeRestoreDialog);
document.querySelector("#restore-cancel").addEventListener("click", closeRestoreDialog);
restoreDialog.addEventListener("click", (event) => {
  if (event.target === restoreDialog) closeRestoreDialog();
});
document.querySelector("#restore-confirm").addEventListener("click", () => {
  if (!pendingBackup) return;
  try {
    restoreBackup(pendingBackup);
    pendingBackup = null;
    restoreDialog.close();
    backupInput.value = "";
    showBackupStatus("バックアップを復元しました。");
  } catch {
    showBackupStatus("保存領域に書き込めませんでした。現在のデータは変更されていません。", true);
    restoreDialog.close();
    pendingBackup = null;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

render();
