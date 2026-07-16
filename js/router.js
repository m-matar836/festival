const ROUTES = {

    dashboard: {
        page: "pages/dashboard.html",
        title: "Dashboard"
    },

    sales: {
        page: "pages/sales.html",
        title: "Sales"
    },

    inventory: {
        page: "pages/inventory.html",
        title: "Inventory"
    },

    reports: {
        page: "pages/reports.html",
        title: "Reports"
    },

    products: {
        page: "pages/products.html",
        title: "Products"
    },

    returns: {
        page: "pages/returns.html",
        title: "Returns"
    },
    festivals:{

    page:"pages/festivals.html",

    title:"Festivals"

}
    

};

async function navigate(page){

    if(!ROUTES[page]){
        page = "dashboard";
    }

    const route = ROUTES[page];

    const response = await fetch(route.page);

    const html = await response.text();

    document.getElementById("app").innerHTML = html;

    document.getElementById("pageTitle").innerText =
        route.title;

    history.pushState(
        {},
        "",
        "#" + page
    );

    document
    .querySelectorAll(".menu li")
    .forEach(li => li.classList.remove("active"));

    const active =
    document.querySelector(
        `[data-route="${page}"]`
    );

    if(active){
        active.classList.add("active");
    }

switch(page){

    case "dashboard":
        loadDashboard();
        break;

    case "sales":
        loadSalesPage();
        break;

    case "inventory":
        loadInventory();
        break;

    case "products":
        loadProducts();
        break;

    case "reports":
        loadReports();
        break;
        case "festivals":

    loadFestivals();

break;
}
    setTimeout(() => {

    addQRButton(page);

}, 100);

}