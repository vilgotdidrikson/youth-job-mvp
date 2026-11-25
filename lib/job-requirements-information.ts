export interface PublicJobInformationData {title:string;description:string;requirements:string}
export class JobInsightError extends Error {constructor(){super("Annonsens kravinformation kunde inte hämtas. Försök igen; din ansökan påverkas inte.");}}
export function parseJobInsight(value:unknown,jobId:string):PublicJobInformationData {
 if(!value||typeof value!=="object"||Array.isArray(value))throw new JobInsightError();
 const v=value as Record<string,unknown>;
 if(v.job_id!==jobId||typeof v.title!=="string"||!v.title.trim()||v.title.length>500)throw new JobInsightError();
 for(const [key,limit]of [["description",60000],["requirements",30000]] as const)if(v[key]!==null&&(typeof v[key]!=="string"||(v[key] as string).length>limit))throw new JobInsightError();
 // Project only published listing text. Never pass through scoring/rubric fields.
 return{title:v.title,description:v.description===null?"":v.description as string,requirements:v.requirements===null?"":v.requirements as string};
}
