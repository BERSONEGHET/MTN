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

export const olistConnections=sqliteTable("olist_connections",{
 owner:text("owner").primaryKey(),credentials:text("credentials").notNull(),tokens:text("tokens"),epoch:text("epoch").notNull(),
 lockId:text("lock_id"),lockUntil:integer("lock_until").notNull().default(0),nextRequest:integer("next_request").notNull().default(0)
});
export const olistOauth=sqliteTable("olist_oauth",{
 state:text("state").primaryKey(),owner:text("owner").notNull(),browser:text("browser").notNull(),epoch:text("epoch").notNull(),
 redirectUri:text("redirect_uri").notNull(),expires:integer("expires").notNull()
});
export const olistLinks=sqliteTable("olist_links",{
 owner:text("owner").notNull(),productId:text("product_id").notNull(),remoteId:integer("remote_id").notNull(),parentId:integer("parent_id"),sku:text("sku").notNull(),syncedAt:text("synced_at").notNull()
},t=>[uniqueIndex("olist_link_product").on(t.owner,t.productId),uniqueIndex("olist_link_remote").on(t.owner,t.remoteId)]);
export const olistPlans=sqliteTable("olist_plans",{
 id:text("id").primaryKey(),owner:text("owner").notNull(),epoch:text("epoch").notNull(),plan:text("plan").notNull(),state:text("state").notNull().default("ready"),expires:integer("expires").notNull(),result:text("result")
});
