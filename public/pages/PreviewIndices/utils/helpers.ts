/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { FieldItem } from "../../../../models/interfaces";

export const parseFieldOptions = (prefix: string, mappings: any): FieldItem[] => {
  let fieldsOption: FieldItem[] = [];
  for (let field in mappings) {
    if (mappings.hasOwnProperty(field)) {
      if (mappings[field].type != "object" && mappings[field].type != null && mappings[field].type != "nested")
        fieldsOption.push({ label: prefix + field, type: mappings[field].type, path: mappings[field].path });
      if (mappings[field].fields != null)
        fieldsOption = fieldsOption.concat(parseFieldOptions(prefix + field + ".", mappings[field].fields));
      if (mappings[field].properties != null)
        fieldsOption = fieldsOption.concat(parseFieldOptions(prefix + field + ".", mappings[field].properties));
    }
  }
  return fieldsOption;
};

export const compareFieldItem = (itemA: FieldItem, itemB: FieldItem): boolean => {
  return itemB.label == itemA.label && itemA.type == itemB.type;
};
