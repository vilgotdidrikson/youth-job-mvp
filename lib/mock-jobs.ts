export interface JobCard {
  id: string;
  title: string;
  company: string;
  city: string;
  type: "part-time" | "summer" | "weekend";
  pay: string;
  tags: string[];
  description: string;
}

export const mockJobs: JobCard[] = [
  {
    id: "job-1",
    title: "Cafe Crew",
    company: "Fika Corner",
    city: "Stockholm",
    type: "part-time",
    pay: "145 SEK/h",
    tags: ["service", "evening", "social"],
    description: "Help with customer service, simple prep, and closing routines on weekday evenings.",
  },
  {
    id: "job-2",
    title: "Summer Park Assistant",
    company: "City Parks",
    city: "Göteborg",
    type: "summer",
    pay: "138 SEK/h",
    tags: ["outdoors", "team", "summer"],
    description: "Support event setup, guide visitors, and keep activity areas organized during summer events.",
  },
  {
    id: "job-3",
    title: "Retail Weekend Helper",
    company: "North Mall",
    city: "Malmö",
    type: "weekend",
    pay: "150 SEK/h",
    tags: ["retail", "cashier", "weekend"],
    description: "Assist with checkout, shelf restock, and customer support on weekends.",
  },
  {
    id: "job-4",
    title: "Junior Warehouse Picker",
    company: "SwiftBox",
    city: "Uppsala",
    type: "part-time",
    pay: "152 SEK/h",
    tags: ["logistics", "afternoon", "active"],
    description: "Pick and pack online orders with a small team during afternoon shifts.",
  },
  {
    id: "job-5",
    title: "Youth Football Camp Host",
    company: "Active Arena",
    city: "Västerås",
    type: "summer",
    pay: "140 SEK/h",
    tags: ["sports", "kids", "summer"],
    description: "Welcome participants, organize equipment, and support coaches at the summer football camp.",
  },
];
