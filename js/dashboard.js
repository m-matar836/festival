async function loadDashboard(){

    const dash =
    await api("getDashboard");

    const products =
    await api("getProducts");

    if(dash.success){

        document.getElementById(
            "todaySales"
        ).innerText =
        dash.today || 0;

        document.getElementById(
            "monthSales"
        ).innerText =
        dash.month || 0;
    }

    if(products.success){

        document.getElementById(
            "productsCount"
        ).innerText =
        products.products.length;

        const totalQty =
        products.products.reduce(
            (s,p)=>s+p.qty,
            0
        );

        document.getElementById(
            "totalQty"
        ).innerText =
        totalQty;
    }

}