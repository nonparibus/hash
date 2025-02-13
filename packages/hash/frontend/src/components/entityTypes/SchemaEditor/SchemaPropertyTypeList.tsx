import {
  ComponentProps,
  ReactNode,
  useContext,
  useMemo,
  FunctionComponent,
} from "react";
import { Schema } from "jsonschema";

import { tw } from "twind";
import { primitiveJsonTypes } from "@hashintel/hash-shared/json-utils";
import { SchemaOptionsContext, SchemaSelectElementType } from "./SchemaEditor";
import { SelectInput } from "../../forms/SelectInput";

type SchemaPropertyTypeListProps = {
  hasSubSchema: boolean;
  propertyName: string;
  GoToSchemaElement: SchemaSelectElementType;
  readonly: boolean;
  type?: Schema["type"];
  $ref?: Schema["$ref"];
  updatePermittedType?: (newType: string) => void; // @todo support selecting multiple types
};

const PropertyTypeDisplay: FunctionComponent<
  Omit<SchemaPropertyTypeListProps, "readonly" | "updatePermittedType">
> = ({ $ref, hasSubSchema, GoToSchemaElement, propertyName, type }) => {
  if ($ref) {
    return <GoToSchemaElement schemaRef={$ref} />;
  }

  return (
    <>
      {(Array.isArray(type) ? type : [type])
        .map<ReactNode>((permittedType) =>
          permittedType === "object" && hasSubSchema ? (
            <GoToSchemaElement schemaRef={propertyName} />
          ) : (
            <span>{permittedType}</span>
          ),
        )
        .reduce((prev, curr) => [prev, ", ", curr])}
    </>
  );
};

const PropertyTypeSelect: FunctionComponent<
  Omit<
    SchemaPropertyTypeListProps,
    "hasSubSchema" | "GoToSchemaElement" | "propertyName" | "readonly"
  >
> = ({ $ref, type, updatePermittedType }) => {
  const { availableEntityTypes, subSchemas } =
    useContext(SchemaOptionsContext) ?? {};

  const currentType = $ref ?? (Array.isArray(type) ? type[0] : type); // @todo support multiple permitted types

  const typeOptions = useMemo(() => {
    const options: ComponentProps<typeof SelectInput>["options"] = [
      {
        disabled: true,
        label: "----- Primitive types -----",
        value: "__primitive_divider",
      },
      ...primitiveJsonTypes.map((primitiveType) => ({
        label: primitiveType,
        value: primitiveType,
      })),
    ];
    if (subSchemas?.length) {
      options.push(
        {
          disabled: true,
          label: "----- Sub-schemas -----",
          value: "__subschema_divider",
        },
        ...subSchemas.map((subSchema) => ({
          label: subSchema[0],
          value: `#/$defs/${subSchema[0]}`,
        })),
      );
    }
    if (availableEntityTypes?.length) {
      options.push(
        {
          disabled: true,
          label: "---- Entity types ----",
          value: "__other_type_divider",
        },
        ...availableEntityTypes
          .sort((a, b) => a.schema.title.localeCompare(b.schema.title))
          .map((entityType) => ({
            label: entityType.schema.title,
            value: entityType.schema.$id,
          })),
      );
    }
    return options;
  }, [availableEntityTypes, subSchemas]);

  return (
    <SelectInput
      className={tw`w-32`}
      options={typeOptions}
      onChangeValue={updatePermittedType}
      value={currentType}
    />
  );
};

export const SchemaPropertyTypeList: FunctionComponent<
  SchemaPropertyTypeListProps
> = ({ readonly, ...props }) => {
  if (!readonly) {
    return <PropertyTypeSelect {...props} />;
  }

  return <PropertyTypeDisplay {...props} />;
};
