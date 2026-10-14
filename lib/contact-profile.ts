/** Account/contact edits must never carry CV facts or recruitment sections. */
export function contactProfilePayload(input:{name:string;dateOfBirth:string;address:string;postalCode:string;city:string},today=new Date()) {
  const fullName=input.name.replace(/\s+/g,' ').trim();
  if(!fullName)throw new Error('Ange ditt fullständiga namn.');
  let age:number|null=null;
  const todayDate=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));
  if(input.dateOfBirth){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth))throw new Error('Kontrollera födelsedatumet.');
    const date=new Date(`${input.dateOfBirth}T00:00:00Z`);
    if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==input.dateOfBirth||date>todayDate)throw new Error('Kontrollera födelsedatumet.');
    age=todayDate.getUTCFullYear()-date.getUTCFullYear();
    if(todayDate.getUTCMonth()<date.getUTCMonth()||(todayDate.getUTCMonth()===date.getUTCMonth()&&todayDate.getUTCDate()<date.getUTCDate()))age--;
    if(age>120)throw new Error('Kontrollera födelsedatumet.');
  }
  return {full_name:fullName,date_of_birth:input.dateOfBirth||null,age,address:input.address.trim()||null,postal_code:input.postalCode.trim()||null,city:input.city.trim()||null};
}
