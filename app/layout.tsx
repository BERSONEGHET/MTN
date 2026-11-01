import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"MTN · Cadastro de produtos",description:"Produtos, SKUs e preços da MTN em um único lugar.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
