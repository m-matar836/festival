let PRODUCTS = [];

async function loadProducts() {
  const res = await api("getProducts");

  if (!res.success) return;

  PRODUCTS = res.products;

  renderProductsAdmin();
}

function renderProductsAdmin() {

  const grid = document.getElementById("productsGrid");

  grid.innerHTML = "";

  PRODUCTS.forEach(p => {

    grid.innerHTML += `
      <div class="product-card">
        <h3>${p.name}</h3>
        <p>${p.price}</p>
        <p>Stock: ${p.qty}</p>

        <button onclick="editProduct('${p.barcode}')">Edit</button>
        <button onclick="deleteProduct('${p.barcode}')">Delete</button>
      </div>
    `;
  });
}

async function addProduct(product) {

  const res = await api("addProduct", product);

  if (res.success) {
    alert("Product added");
    loadProducts();
  }
}