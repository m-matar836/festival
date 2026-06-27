let qrScanner = null;
let PRODUCTS = [];
let CART = [];

async function loadSalesPage(){

    const res =
    await api("getProducts");

    if(!res.success){
        alert("Error");
        return;
    }

    PRODUCTS = res.products;

    renderProducts(PRODUCTS);
}

function renderProducts(products){

    const grid =
    document.getElementById(
        "productsGrid"
    );

    grid.innerHTML = "";

    products.forEach(p=>{

        grid.innerHTML += `
        <div class="product-card">

            <h3>${p.name}</h3>

            <p>
              ${p.price}
            </p>

            <p>
              Stock: ${p.qty}
            </p>

            <button
            onclick="addToCart('${p.barcode}')">

            إضافة

            </button>

        </div>
        `;

    });

}

function searchProducts(){

    const keyword =
    document.getElementById(
        "searchProduct"
    ).value.toLowerCase();

    const filtered =
    PRODUCTS.filter(p=>

        p.name.toLowerCase()
        .includes(keyword)

        ||

        String(p.barcode)
        .includes(keyword)

    );

    renderProducts(filtered);

}

function addToCart(barcode){

    const product =
    PRODUCTS.find(
      p=>p.barcode==barcode
    );

    if(!product)
      return;

    const existing =
    CART.find(
      c=>c.barcode==barcode
    );

    if(existing){

        existing.qty++;

    }else{

        CART.push({

            barcode:
            product.barcode,

            name:
            product.name,

            price:
            product.price,

            qty:1

        });

    }

    renderCart();

}

function renderCart(){

    const table =
    document.getElementById(
        "cartTable"
    );

    table.innerHTML = "";

    let total = 0;

    CART.forEach((item,index)=>{

        const rowTotal =
        item.qty * item.price;

        total += rowTotal;

        table.innerHTML += `
        <tr>

            <td>
                ${item.name}
            </td>

            <td>

                <input
                type="number"
                min="1"
                value="${item.qty}"

                onchange="
                updateQty(
                ${index},
                this.value
                )">

            </td>

            <td>

                ${rowTotal}

            </td>

            <td>

                <button
                onclick="
                removeItem(
                ${index}
                )">

                X

                </button>

            </td>

        </tr>
        `;

    });

const discount =
Number(
document.getElementById(
"discount"
)?.value || 0
);

const finalTotal =
total - (
total * discount / 100
);

document.getElementById(
"subTotal"
).innerText =
total.toFixed(2);

document.getElementById(
"grandTotal"
).innerText =
finalTotal.toFixed(2);

}

function updateQty(index,value){

    CART[index].qty =
    Number(value);

    renderCart();

}

function removeItem(index){

    CART.splice(index,1);

    renderCart();

}

async function checkout(){

    if(CART.length===0){

        alert(
          "السلة فارغة"
        );

        return;
    }

    const user =
    getSession();

const subTotal =
CART.reduce(
(s,i)=>s+(i.qty*i.price)
,0);

const discount =
Number(
document.getElementById(
"discount"
).value || 0
);

const total =
subTotal - (
subTotal * discount / 100
);

let res;

if (!navigator.onLine) {

  addToQueue("addSale", {
    items: CART,
    total,
    user: user.username
  });

  res = {
    success: true,
    invoice: "OFFLINE-" + Date.now()
  };

  alert("تم الحفظ Offline وسيتم المزامنة لاحقاً");

} else {

  res = await api("addSale", {
    items: CART,
    total,
    user: user.username
  });

  if (!res.success) {
    alert(res.message);
    return;
  }

  exportInvoice(res.invoice, CART, total);
  await api("openCashDrawer");
}

    if(!res.success){

        alert(
          res.message
        );

        return;
    }

    alert(
      "تم البيع\n"+
      res.invoice
    );
    CART=[];

    renderCart();

    loadSalesPage();
    await api("openCashDrawer");

}

function scanBarcode(){

  startQRScanner((code)=>{

    console.log("Barcode:", code);

    // تحط الكود داخل البحث أو السلة
    const product = PRODUCTS.find(p => p.barcode == code);

    if(product){
      addToCart(product.barcode);
    } else {
      alert("Product not found");
    }

  });

}

async function scanBarcode(){

    document
    .getElementById(
        "scannerModal"
    )
    .style.display =
    "flex";

    qrScanner =
    new Html5Qrcode(
        "reader"
    );

    try{

        await qrScanner.start(

            {
                facingMode:"environment"
            },

            {
                fps:10,
                qrbox:250
            },

            onBarcodeDetected

        );

    }catch(err){

        console.error(err);

        alert(
            "Camera Error"
        );

    }

}

function onBarcodeDetected(code){

    const product =
    PRODUCTS.find(

        p=>
        String(
            p.barcode
        ) ===
        String(code)

    );

    if(product){

        addToCart(
            product.barcode
        );

        closeScanner();

    }else{

        alert(
            "المنتج غير موجود"
        );

    }

}

async function closeScanner(){

    document
    .getElementById(
        "scannerModal"
    )
    .style.display =
    "none";

    if(qrScanner){

        try{

            await qrScanner.stop();

            await qrScanner.clear();

        }catch(err){}

        qrScanner = null;

    }

}

document.addEventListener(
"keydown",
handleScannerInput
);

let barcodeBuffer = "";

function handleScannerInput(e){

    if(
        location.hash !==
        "#sales"
    ){
        return;
    }

    if(
        e.key === "Enter"
    ){

        const code =
        barcodeBuffer.trim();

        barcodeBuffer="";

        if(!code)
            return;

        const product =
        PRODUCTS.find(

            p=>
            String(
                p.barcode
            ) === code

        );

        if(product){

            addToCart(
                product.barcode
            );

        }

        return;
    }

    barcodeBuffer +=
    e.key;

}