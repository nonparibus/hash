import { useQuery } from "@apollo/client";
import { GetBlockProtocolBlocksQuery } from "../../graphql/apiTypes.gen";
import { getBlockProtocolBlocksQuery } from "../../graphql/queries/block.queries";

export const useGetBlockProtocolBlocks = () => {
  const { data, error } = useQuery<GetBlockProtocolBlocksQuery>(
    getBlockProtocolBlocksQuery,
    {},
  );

  return { data, error };
};
