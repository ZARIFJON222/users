const API_URL =
  window.location.protocol === "file:" ? "http://127.0.0.1:3000" : "/api/users";

const userForm = document.getElementById("user-form");
const editForm = document.getElementById("edit-form");
const saveButton = document.getElementById("save-btn");
const editSaveButton = document.getElementById("edit-save-btn");
const searchInput = document.getElementById("search-input");
const userList = document.getElementById("user-list");
const emptyState = document.getElementById("empty-state");
const editModal = document.getElementById("edit-modal");
const editCloseButton = document.getElementById("edit-close-btn");

let users = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function getPayload(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    website: String(formData.get("website") || "").trim(),
  };
}

function createCard(user) {
  return `
    <article class="user-card">
      <div class="user-head">
        <div class="avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div>
        <div>
          <h2>${escapeHtml(user.name)}</h2>
          <p>${escapeHtml(user.website)}</p>
        </div>
      </div>
      <div class="user-detail">
        <span class="detail-icon">✉</span>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <div class="user-detail">
        <span class="detail-icon">☎</span>
        <p>${escapeHtml(user.phone)}</p>
      </div>
      <div class="card-actions">
        <button type="button" class="action-button" data-action="edit" data-id="${escapeHtml(user.id)}">
          Tahrirlash
        </button>
        <button type="button" class="action-button danger" data-action="delete" data-id="${escapeHtml(user.id)}">
          O'chirish
        </button>
      </div>
    </article>
  `;
}

function showUsers() {
  const searchText = searchInput.value.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!searchText) return true;
    return [user.name, user.email, user.phone, user.website].some((value) =>
      String(value).toLowerCase().includes(searchText),
    );
  });

  userList.innerHTML = filteredUsers.map(createCard).join("");
  emptyState.classList.toggle("hidden", filteredUsers.length > 0);
}

function openModal(user) {
  editModal.dataset.id = user.id;
  editForm.elements.name.value = user.name;
  editForm.elements.email.value = user.email;
  editForm.elements.phone.value = user.phone;
  editForm.elements.website.value = user.website;
  editModal.classList.add("show");
}

function closeModal() {
  editModal.classList.remove("show");
  editForm.reset();
  delete editModal.dataset.id;
}

async function loadUsers() {
  try {
    const response = await fetch(API_URL);
    if (response.ok) {
      users = await response.json();
      showUsers();
    }
  } catch (error) {
    console.error("Server bilan bog'lanishda xatolik");
  }
}

async function addUser(event) {
  event.preventDefault();
  const newUser = getPayload(userForm);
  saveButton.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });

    if (response.ok) {
      const savedUser = await response.json();
      users.unshift(savedUser);
      userForm.reset();
      showUsers();
    }
  } catch (error) {
    console.error("Qo'shishda xatolik");
  } finally {
    saveButton.disabled = false;
  }
}

async function editUser(event) {
  event.preventDefault();
  const id = editModal.dataset.id;
  if (!id) return;

  const updatedUser = getPayload(editForm);
  editSaveButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedUser),
    });

    if (response.ok) {
      const savedUser = await response.json();
      users = users.map((user) =>
        String(user.id) === String(id) ? savedUser : user,
      );
      showUsers();
      closeModal();
    }
  } catch (error) {
    console.error("Yangilashda xatolik");
  } finally {
    editSaveButton.disabled = false;
  }
}

async function deleteUser(id) {
  if (!window.confirm("Rostdan ham o'chirmoqchimisiz?")) return;

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      users = users.filter((user) => String(user.id) !== String(id));
      showUsers();
    }
  } catch (error) {
    console.error("O'chirishda xatolik");
  }
}

function handleButtons(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "edit") {
    const user = users.find((item) => String(item.id) === String(id));
    if (user) openModal(user);
  } else if (action === "delete") {
    deleteUser(id);
  }
}

userForm.addEventListener("submit", addUser);
editForm.addEventListener("submit", editUser);
editCloseButton.addEventListener("click", closeModal);
userList.addEventListener("click", handleButtons);
searchInput.addEventListener("input", showUsers);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

loadUsers();
