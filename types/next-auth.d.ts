import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string | null
      imageType?: string | null
      updatedAt?: string | null
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    username?: string | null
    imageType?: string | null
    updatedAt?: string | Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username?: string | null
    imageType?: string | null
    updatedAt?: string | null
  }
}
