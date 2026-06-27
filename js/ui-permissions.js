function applyPermissions() {

  const user = getSession();
  if (!user) return;

  const role = user.role;

  document.querySelectorAll("[data-role]").forEach(el => {

    const allowed = el.dataset.role.split(",");

    if (!allowed.includes(role) && !allowed.includes("all")) {
      el.style.display = "none";
    }

  });
}