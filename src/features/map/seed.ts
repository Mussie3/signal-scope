import { Service, Connection } from "./types";

const Frontend: Service = {
    id: "frontend",
    name: "Frontend",
    kind: "api",
    region: "US East",
    position: { x: 500, y: 100 },
}

const AuthAPI: Service = {
    id: "auth-api",
    name: "Auth API",
    kind: "api",
    region: "US East",
    position: { x: 280, y: 280 },
}

const ProductAPI: Service = {
    id: "product-api",
    name: "Product API",
    kind: "api",
    region: "EU Central",
    position: { x: 720, y: 280 },
}

const UserDB: Service = {
    id: "user-db",
    name: "User DB",
    kind: "database",
    region: "US East",
    position: { x: 200, y: 480 },
}

const ProductDB: Service = {
    id: "product-db",
    name: "Product DB",
    kind: "database",
    region: "EU Central",
    position: { x: 620, y: 480 },
}

const ProductCache: Service = {
    id: "product-cache",
    name: "Product Cache",
    kind: "cache",
    region: "Asia Pacific",
    position: { x: 870, y: 480 },
}

const FrontendAuthAPIConnection: Connection = {
    id: "frontend-auth-api-connection",
    sourceId: Frontend.id,
    targetId: AuthAPI.id,
    buffer: []
}

const AuthAPIUserDBConnection: Connection = {
    id: "auth-api-user-db-connection",
    sourceId: AuthAPI.id,
    targetId: UserDB.id,
    buffer: []
}

const FrontendProductAPIConnection: Connection = {
    id: "frontend-product-api-connection",
    sourceId: Frontend.id,
    targetId: ProductAPI.id,
    buffer: []
}

const ProductAPIProductDBConnection: Connection = {
    id: "product-api-product-db-connection",
    sourceId: ProductAPI.id,
    targetId: ProductDB.id,
    buffer: []
}

const ProductAPIProductCacheConnection: Connection = {
    id: "product-api-product-cache-connection",
    sourceId: ProductAPI.id,
    targetId: ProductCache.id,
    buffer: []
}


export const seedServices: Service[] = [
    Frontend,
    AuthAPI,
    UserDB,
    ProductAPI,
    ProductDB,
    ProductCache
]

export const seedConnections: Connection[] = [
    FrontendAuthAPIConnection,
    AuthAPIUserDBConnection,
    FrontendProductAPIConnection,
    ProductAPIProductDBConnection,
    ProductAPIProductCacheConnection
]
