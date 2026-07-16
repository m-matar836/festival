function getRole(){
  const user = getSession();
  return user?.role;
}

function can(action){

  const role = getRole();

  const rules = {
    admin: ["all"],
    cashier: ["sale","inventory"],
    viewer: ["view"]
  };

  if(rules[role]?.includes("all")) return true;

  return rules[role]?.includes(action);
}

function requireRole(action){
  if(!can(action)){
    alert("ليس لديك صلاحية");
    return false;
  }
  return true;
}