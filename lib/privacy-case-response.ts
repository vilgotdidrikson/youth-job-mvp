// Internal service target, independent of the case's external reply deadline.
// Calendar: Monday–Friday excluding Swedish public holidays (SFS 1989:253).
const day = 86400000;
const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" });
function holiday(date: Date) {
  const y=date.getUTCFullYear(),md=date.toISOString().slice(5,10);
  if(["01-01","01-06","05-01","06-06","12-25","12-26"].includes(md))return true;
  // Gregorian Easter (Meeus/Jones/Butcher); Sunday holidays are skipped below.
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const n=h+l-7*m+114,easter=Date.UTC(y,Math.floor(n/31)-1,n%31+1);
  return [-2,1,39].some(offset=>date.getTime()===easter+offset*day);
}
export function firstResponseTarget(created: string) {
  if(!Number.isFinite(Date.parse(created)))throw Error("Ogiltigt mottagningsdatum.");
  let date=new Date(localDate.format(new Date(created))+"T00:00:00Z");
  for(let remaining=5;remaining>0;){date=new Date(date.getTime()+day);if(date.getUTCDay()!==0&&date.getUTCDay()!==6&&!holiday(date))remaining--;}
  // The target day is a weekday, so no DST transition occurs before its end.
  const noon=new Date(date.getTime()+12*3600000);
  const offset=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Stockholm",hour:"2-digit",hourCycle:"h23"}).format(noon))-12;
  return date.getTime()+day-offset*3600000-1;
}
