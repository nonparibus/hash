import { VoidFunctionComponent } from "react";
import { Schema } from "jsonschema";

import { SchemaSelectElementType } from "./SchemaEditor";

type SchemaPropertyTypeListProps = {
  hasSubSchema: boolean;
  propertyName: string;
  SchemaSelect: SchemaSelectElementType;
  type?: Schema["type"];
  $ref?: Schema["$ref"];
};

export const SchemaPropertyTypeList: VoidFunctionComponent<SchemaPropertyTypeListProps> =
  ({
    hasSubSchema,
    propertyName,
    SchemaSelect,
    type: typeMaybeArray,
    $ref,
  }) => {
    if ($ref) {
      return <SchemaSelect schemaRef={$ref} />;
    }

    return (
      <>
        {(typeMaybeArray instanceof Array ? typeMaybeArray : [typeMaybeArray])
          .map<React.ReactNode>((type) =>
            type === "object" && hasSubSchema ? (
              <SchemaSelect schemaRef={propertyName} />
            ) : (
              <span>type</span>
            ),
          )
          .reduce((prev, curr) => [prev, ", ", curr])}
      </>
    );
  };
