import { JSONObject } from "@hashintel/block-protocol";
import { UserInputError } from "apollo-server-core";

import { CreateEntityArgs } from "../../model";
import { isSystemType } from "../../types/entityTypes";
import { exactlyOne } from "../../util";

/** Builds the argument object for the createEntity function. It checks that exactly
 * one of entityTypeId, entityTypeVersionId or systemTypeName is set, and returns
 * the correct variant of CreateEntityArgs.
 */
export const createEntityArgsBuilder = (params: {
  accountId: string;
  createdById: string;
  properties: JSONObject;
  versioned: boolean;
  entityTypeId?: string | null;
  entityTypeVersionId?: string | null;
  systemTypeName?: string | null;
}): CreateEntityArgs => {
  if (
    !exactlyOne(
      params.entityTypeId,
      params.entityTypeVersionId,
      params.systemTypeName
    )
  ) {
    throw new UserInputError(
      "exactly one of entityTypeId, entityTypeVersionId or systemTypeName must be provided"
    );
  }

  let args: CreateEntityArgs;
  const _args = {
    accountId: params.accountId,
    createdById: params.createdById,
    versioned: params.versioned,
    properties: params.properties,
  };
  if (params.entityTypeId) {
    args = { ..._args, entityTypeId: params.entityTypeId };
  } else if (params.entityTypeVersionId) {
    args = { ..._args, entityTypeVersionId: params.entityTypeVersionId };
  } else if (params.systemTypeName) {
    if (!isSystemType(params.systemTypeName)) {
      throw new UserInputError(
        `Invalid system type name "${params.systemTypeName}"`
      );
    }
    args = { ..._args, systemTypeName: params.systemTypeName };
  } else {
    throw new Error("unreachable");
  }

  return args;
};
