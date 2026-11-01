import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const products = sqliteTable("products", {
 id:text("id").primaryKey(), owner:text("owner").notNull(), modelId:text("model_id"),
 name:text("name").notNull(), gender:text("gender").notNull(), seq:integer("seq"), sku:text("sku").notNull(),
 skuKey:text("sku_key"), color:text("color").notNull(), size:text("size").notNull(),
 supplier:text("supplier").notNull().default(""), supplierRef:text("supplier_ref").notNull().default(""),
 quantity:integer("quantity").notNull().default(0), cost:integer("cost").notNull().default(0),
 price:integer("price"), legacy:integer("legacy").notNull().default(0), version:integer("version").notNull().default(1),
 createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull()
},t=>[uniqueIndex("products_new_sku").on(t.owner,t.skuKey)]);
export const models = sqliteTable("models",{
 id:text("id").primaryKey(),owner:text("owner").notNull(),name:text("name").notNull(),gender:text("gender").notNull(),
 prefix:text("prefix").notNull(), seq:integer("seq").notNull(),createdAt:text("created_at").notNull()
});
export const counters=sqliteTable("counters",{owner:text("owner").primaryKey(),value:integer("value").notNull().default(0)});
export const mutations=sqliteTable("mutations",{id:text("id").primaryKey(),owner:text("owner").notNull(),createdAt:text("created_at").notNull()});

export const skuHistory=sqliteTable("sku_history",{
 id:text("id").primaryKey(),owner:text("owner").notNull(),productId:text("product_id").notNull(),
 oldSku:text("old_sku").notNull(),newSku:text("new_sku").notNull(),changedAt:text("changed_at").notNull()
});
