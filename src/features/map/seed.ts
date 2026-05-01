import { Service, Connection } from "./types";

const Frontend: Service = {
    id: "frontend",
    name: "Frontend",
    kind: "api",
    position: {
        x: 50,
        y: 50
    }
}

const AuthAPI: Service = {
    id: "auth-api",
    name: "Auth API",
    kind: "api",
    position: {
        x: 150,
        y: 100
    }
}

const UserDB: Service = {
    id: "user-db",
    name: "User DB",
    kind: "database",
    position: {
        x: 350,
        y: 100
    } 
}

const ProductAPI: Service = {
    id: "product-api",
    name: "Product API",
    kind: "api",
    position: {
        x: 100,
        y: 350
    }
}

const ProductDB: Service = {
    id: "product-db",
    name: "Product DB",
    kind: "database",
    position: {
        x: 400,
        y: 450
    }
}

const ProductCache: Service = {
    id: "product-cache",
    name: "Product Cache",
    kind: "cache",
    position: {
        x: 700,
        y: 50
    }
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