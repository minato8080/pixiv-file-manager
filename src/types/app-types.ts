import { AuthorInfo } from "@/bindings/AuthorInfo";
import { Item } from "../dropdown";
import { Expand } from "./util-types";
import { CharacterInfo } from "@/bindings/CharacterInfo";

export type CharacterDropdown = Expand<CharacterInfo & Item>;
export type AuthorDropdown = Expand<AuthorInfo & Item>;
