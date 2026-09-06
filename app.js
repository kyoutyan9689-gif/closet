const STORAGE_KEY = "closet-items-v1";
const INITIAL_ITEMS = [
  ["スーツ", 4],
  ["ワイシャツブルー", 3],
  ["ワイシャツホワイト", 1],
  ["長ズボン", 4],
  ["デニム", 2],
  ["ロンT", 1],
  ["ロンヒート", 2],
  ["タイツ", 2],
  ["アウター夏", 1],
  ["アウター春秋", 1],
  ["アウター冬", 3],
  ["マフラー", 1],
  ["夏パジャマセット", 1],
  ["冬パジャマセット", 1],
  ["冬ニット", 2],
  ["コート", 1],
  ["ドライシャツ", 2],
  ["ハーフパンツ", 2],
  ["ジャージセット", 1],
  ["肌着", 6],
  ["パンツ", 8],
  ["靴下", 6]
];

const form = document.querySelector("#item-form");
const nameInput = document.querySelector("#item-name");
const quantityInput = document.querySelector("#item-quantity");
const list = document.querySelector("#item-list");
const template = document.querySelector("#item-template");
const totalCount = document.querySelector("#total-count");
const itemKinds = document.querySelector("#item-kinds");
const emptyState = document.querySelector("#empty-state");

let items = loadItems();

function loadItems() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);
    if (savedValue === null) {
      const initialItems = INITIAL_ITEMS.map(([name, quantity], index) => ({
        id: `initial-${index + 1}`,
        name,
        quantity
      }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialItems));
      } catch {
        // 保存が拒否された場合でも、今回の画面には初期データを表示します。
      }
      return initialItems;
    }

    const stored = JSON.parse(savedValue);
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) =>
      typeof item.id === "string" && typeof item.name === "string" && Number.isInteger(item.quantity) && item.quantity >= 0
    );
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function render() {
  list.replaceChildren();

  items.forEach((item) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const name = card.querySelector(".item-name");
    const count = card.querySelector(".item-count");
    const decrease = card.querySelector(".decrease");
    const increase = card.querySelector(".increase");
    const deleteButton = card.querySelector(".delete-button");

    name.textContent = item.name;
    count.textContent = item.quantity;
    count.setAttribute("aria-label", `${item.name}は${item.quantity}点`);
    decrease.disabled = item.quantity === 0;
    decrease.setAttribute("aria-label", `${item.name}を1つ減らす`);
    increase.setAttribute("aria-label", `${item.name}を1つ増やす`);
    deleteButton.setAttribute("aria-label", `${item.name}を削除`);

    decrease.addEventListener("click", () => changeQuantity(item.id, -1));
    increase.addEventListener("click", () => changeQuantity(item.id, 1));
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    list.append(card);
  });

  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  totalCount.textContent = total.toLocaleString("ja-JP");
  itemKinds.textContent = `${items.length}種類`;
  emptyState.hidden = items.length > 0;
}

function changeQuantity(id, amount) {
  items = items.map((item) => item.id === id
    ? { ...item, quantity: Math.max(0, item.quantity + amount) }
    : item
  );
  saveItems();
  render();
}

function deleteItem(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item || !window.confirm(`「${item.name}」を削除しますか？`)) return;
  items = items.filter((candidate) => candidate.id !== id);
  saveItems();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const quantity = Number.parseInt(quantityInput.value, 10);
  if (!name || !Number.isInteger(quantity) || quantity < 1) return;

  const existingIndex = items.findIndex((item) => item.name.localeCompare(name, "ja", { sensitivity: "base" }) === 0);
  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    items.splice(existingIndex, 1);
    items.unshift({ ...existing, quantity: existing.quantity + quantity });
  } else {
    items.unshift({ id: crypto.randomUUID(), name, quantity });
  }

  saveItems();
  render();
  form.reset();
  quantityInput.value = "1";
  nameInput.focus();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

render();
