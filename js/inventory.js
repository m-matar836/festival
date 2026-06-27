let INVENTORY = [];

async function loadInventory(){

    const res =
    await api(
      "getProducts"
    );

    if(!res.success)
        return;

    INVENTORY =
    res.products;

    renderInventory(
      INVENTORY
    );

}

function renderInventory(data){

    const table =
    document.getElementById(
      "inventoryTable"
    );

    table.innerHTML="";

    data.forEach(p=>{

      const low =
      p.qty <= 5
      ? "low-stock"
      : "";

      table.innerHTML += `
      <tr class="${low}">

          <td>${p.barcode}</td>

          <td>${p.name}</td>

          <td>${p.price}</td>

          <td>${p.qty}</td>

      </tr>
      `;

    });

}

function filterInventory(){

    const q =
    document
    .getElementById(
      "searchInventory"
    )
    .value
    .toLowerCase();

    const filtered =
    INVENTORY.filter(p=>

      p.name
      .toLowerCase()
      .includes(q)

      ||

      String(
      p.barcode
      ).includes(q)

    );

    renderInventory(
      filtered
    );

}

async function addStock(){

    const barcode =
    document.getElementById(
      "barcode"
    ).value;

    const qty =
    document.getElementById(
      "qty"
    ).value;

    const res =
    await api(
      "addStock",
      {
        barcode,
        qty
      }
    );

    if(res.success){

        alert(
          "تمت الإضافة"
        );

        loadInventory();

    }

}

async function removeStock(){

    const barcode =
    document.getElementById(
      "barcode"
    ).value;

    const qty =
    document.getElementById(
      "qty"
    ).value;

    const res =
    await api(
      "removeStock",
      {
        barcode,
        qty
      }
    );

    if(res.success){

        alert(
          "تم السحب"
        );

        loadInventory();

    }else{

        alert(
          res.message
        );

    }

}