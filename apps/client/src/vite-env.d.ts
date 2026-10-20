/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Surcharge l'adresse du serveur de jeu (ex. wss://jeu.exemple.fr/) si le serveur est séparé du client. */
  readonly VITE_SERVER_URL?: string
}
