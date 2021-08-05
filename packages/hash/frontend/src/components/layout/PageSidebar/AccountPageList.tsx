import { VoidFunctionComponent } from "react";
import Link from "next/link";
import { useQuery } from "@apollo/client";

import { getAccountPages } from "../../../graphql/queries/account.queries";
import {
  GetAccountPagesQuery,
  GetAccountPagesQueryVariables,
} from "../../../graphql/apiTypes.gen";

import styles from "./PageSidebar.module.scss";
import { CreatePageButton } from "../../Modals/CreatePage/CreatePageButton";

type AccountPageListProps = {
  accountId: string;
  currentPageMetaId: string;
};

export const AccountPageList: VoidFunctionComponent<AccountPageListProps> = ({
  currentPageMetaId,
  accountId,
}) => {
  const { data } = useQuery<
    GetAccountPagesQuery,
    GetAccountPagesQueryVariables
  >(getAccountPages, {
    variables: { accountId },
  });

  return (
    <div className={styles.AccountPageList}>
      {data?.accountPages.map((page) => {
        if (page.metadataId === currentPageMetaId) {
          return <div key={page.id}>{page.properties.title}</div>;
        }
        return (
          <div key={page.id}>
            <Link href={`/${accountId}/${page.metadataId}`}>
              <a>{page.properties.title}</a>
            </Link>
          </div>
        );
      })}
      <CreatePageButton accountId={accountId} />
    </div>
  );
};
