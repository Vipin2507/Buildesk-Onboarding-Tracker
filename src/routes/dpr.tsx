import { createFileRoute } from "@tanstack/react-router";

import { MyDprHub } from "@/components/dpr/my-dpr-hub";
import { PageWrap } from "@/components/page-header";

export const Route = createFileRoute("/dpr")({
  component: MyDprPage,
});

function MyDprPage() {
  return (
    <PageWrap>
      <MyDprHub />
    </PageWrap>
  );
}
