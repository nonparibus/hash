export type BlockVariant = {
  description?: string;
  displayName?: string;
  icon?: string;
  properties?: JSONObject;
};

/**
 * @todo type all as unknown and check properly
 * we can't rely on people defining the JSON correctly
 */
export type BlockMetadata = {
  author?: string;
  description?: string;
  displayName?: string;
  externals?: Record<string, string>;
  license?: string;
  icon?: string;
  name?: string;
  schema?: string;
  source?: string;
  variants?: BlockVariant[];
  version?: string;
};

export type BlockProtocolUpdatePayload<T> = {
  entityTypeId?: string | null;
  entityTypeVersionId?: string | null;
  entityId: string;
  accountId?: string | null;
  data: T;
};

export type BlockProtocolCreatePayload<T> = {
  entityTypeId: string;
  entityTypeVersionId?: string | null;
  data: T;
  accountId?: string;
};

export type BlockProtocolFilterOperatorType =
  | "CONTAINS"
  | "DOES_NOT_CONTAIN"
  | "IS"
  | "IS_NOT"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY";

export type BlockProtocolMultiFilterOperatorType = "AND" | "OR";

export type BlockProtocolMultiFilter = {
  filters: {
    field: string;
    operator: BlockProtocolFilterOperatorType;
    value: string;
  }[];
  operator: BlockProtocolMultiFilterOperatorType;
};

export type BlockProtocolMultiSort = {
  field: string;
  desc?: boolean | undefined | null;
}[];

export type BlockProtocolAggregateOperationInput = {
  pageNumber?: number;
  itemsPerPage?: number;
  multiSort?: BlockProtocolMultiSort | null;
  multiFilter?: BlockProtocolMultiFilter | null;
};

export type BlockProtocolLinkedDataDefinition = {
  aggregate?: BlockProtocolAggregateOperationInput & { pageCount?: number };
  entityTypeId?: string;
  entityId?: string;
};

export type BlockProtocolAggregatePayload = {
  entityTypeId?: string;
  entityTypeVersionId?: string | null;
  operation: BlockProtocolAggregateOperationInput;
  accountId?: string;
};

export type BlockProtocolAggregateOperationOutput<T = unknown> = {
  results: T[];
  operation: BlockProtocolAggregateOperationInput & { pageCount: number };
};

export type BlockProtocolAggregateEntityTypesPayload = {
  includeOtherTypesInUse: boolean;
};

export type BlockProtocolCreateFn = {
  <T>(actions: BlockProtocolCreatePayload<T>[]): Promise<unknown[]>;
};

export type BlockProtocolUpdateFn = {
  <T>(actions: BlockProtocolUpdatePayload<T>[]): Promise<unknown[]>;
};

export type BlockProtocolAggregateFn = {
  (
    action: BlockProtocolAggregatePayload,
  ): Promise<BlockProtocolAggregateOperationOutput>;
};

export type BlockProtocolFileMediaType = "image" | "video";

export type BlockProtocolFileUploadFn = {
  (action: {
    file?: File;
    url?: string;
    mediaType: BlockProtocolFileMediaType;
  }): Promise<{
    entityId: string;
    url: string;
    mediaType: BlockProtocolFileMediaType;
  }>;
};

export type BlockProtocolEntityType = {
  entityTypeId: string;
  $id: string;
  $schema: string;
  title: string;
  type: string;
  [key: string]: JSONValue;
};

export type BlockProtocolEntity = {
  accountId: string;
  entityId: string;
  entityTypeId: string;
  [key: string]: JSONValue;
};

export type BlockProtocolLink = {
  sourceEntityId: string;
  destinationEntityId: string;
  destinationEntityVersionId?: string | null;
  index?: number | null;
  path: string;
};

export type BlockProtocolLinkGroup = {
  sourceEntityId: string;
  sourceEntityVersionId: string;
  path: string;
  links: BlockProtocolLink[];
};

export type BlockProtocolCreateLinkFn = {
  (payload: {
    sourceAccountId?: string | null;
    sourceEntityId: string;
    destinationAccountId?: string | null;
    destinationEntityId: string;
    destinationEntityVersionId?: string | null;
    index?: number | null;
    path: string;
  }): Promise<BlockProtocolLink>;
};

export type BlockProtocolDeleteLinkFn = {
  (payload: {
    sourceAccountId?: string | null;
    sourceEntityId: string;
    index?: number | null;
    path: string;
  }): Promise<boolean>;
};

export type BlockProtocolAggregateEntityTypesFn = {
  (action: BlockProtocolAggregateEntityTypesPayload): Promise<
    BlockProtocolAggregateOperationOutput<BlockProtocolEntityType>
  >;
};

export type BlockProtocolFunction =
  | BlockProtocolAggregateFn
  | BlockProtocolCreateFn
  | BlockProtocolUpdateFn
  | BlockProtocolAggregateEntityTypesFn;

export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | JSONObject;

export type JSONObject = { [key: string]: JSONValue };

export interface JSONArray extends Array<JSONValue> {}

/**
 * Block Protocol-specified properties,
 * which the embedding application should provide.
 */
export type BlockProtocolProps = {
  aggregate?: BlockProtocolAggregateFn;
  aggregateLoading?: boolean;
  aggregateError?: Error;
  aggregateEntityTypes?: BlockProtocolAggregateEntityTypesFn;
  create?: BlockProtocolCreateFn;
  createLoading?: boolean;
  createError?: Error;
  createLink?: BlockProtocolCreateLinkFn;
  createLinkLoading?: boolean;
  createLinkError?: Error;
  deleteLink?: BlockProtocolDeleteLinkFn;
  deleteLinkLoading?: boolean;
  deleteLinkError?: Error;
  entityId?: string;
  entityTypeId?: string;
  linkedEntities?: BlockProtocolEntity[];
  linkGroups?: BlockProtocolLinkGroup[];
  id?: string;
  schemas?: Record<string, JSONObject>;
  type?: string;
  update?: BlockProtocolUpdateFn;
  updateLoading?: boolean;
  updateError?: Error;
};
