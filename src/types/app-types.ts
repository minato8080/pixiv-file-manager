import { AuthorInfo } from "@/bindings/AuthorInfo";
import { Item } from "../dropdown";
import { Expand } from "./util-types";

export type CharacterDropdown = Expand<{ character: string } & Item>;
export type AuthorDropdown = Expand<AuthorInfo & Item>;
