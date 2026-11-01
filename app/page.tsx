import {requireChatGPTUser} from "./chatgpt-auth";
import Catalog from "./catalog";
export const dynamic="force-dynamic";
export default async function Home(){const user=await requireChatGPTUser("/");return <Catalog userName={user.userId==="local_seedy"?"Prévia local":user.fullName||"Bernardo"}/>;}
