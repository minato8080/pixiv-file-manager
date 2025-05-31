import { Item } from "../components/dropdown-button";

import { AuthorInfo } from "@/bindings/AuthorInfo";
import { CharacterInfo } from "@/bindings/CharacterInfo";
import { TagInfo } from "@/bindings/TagInfo";
import { Expand } from "@/src/types/util-types";

export type CharacterDropdown = Expand<CharacterInfo & Item>;
export type AuthorDropdown = Expand<AuthorInfo & Item>;
export type TagDropdown = Expand<TagInfo & Item>;
