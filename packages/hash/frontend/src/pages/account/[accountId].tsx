import { VoidFunctionComponent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@apollo/client";

import { getAccountPages } from "../../graphql/queries/account.queries";
import {
  GetAccountPagesQuery,
  GetAccountPagesQueryVariables,
} from "../../graphql/apiTypes.gen";

import styles from "../index.module.scss";

export const AccountHome: VoidFunctionComponent = () => {
  const { query } = useRouter();
  const accountId = query.accountId as string;

  const { data } = useQuery<
    GetAccountPagesQuery,
    GetAccountPagesQueryVariables
  >(getAccountPages, {
    variables: { accountId },
  });

  return (
    <main className={styles.Main}>
      <header>
        <h1>Pages in account {accountId}</h1>
      </header>
      <ul>
        {data?.accountPages.map((page) => (
          <li key={page.id}>
            <Link href={`/${accountId}/${page.id}`}>
              <a>{page.properties.title}</a>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default AccountHome;
