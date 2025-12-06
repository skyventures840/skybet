const ResponsibleGambling = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Responsible Gambling</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <h3>RESPONSIBLE GAMING POLICY</h3>
          <h3>1 INTRODUCTION</h3>
          <p>In Our company we are committed to responsible gambling and take our customers and our social responsibility very seriously. Our products are designed for your entertainment and enjoyment and we are committed to providing a secure, fair and socially responsible service. We want you to enjoy our products safely and responsibly. We believe in a firm but fair approach to responsible gambling. That is why to assist you, we offer a range of advice and options to help you manage your gaming and ensure that everyone who enjoys our service can do so in as safe a way as possible. Responsible gaming is a serious matter and if you feel like gambling is becoming a problem, help is readily accessible. Our customer service staff are available to listen and to support you in keeping control,.</p>

          <h3>2 RESPONSIBLE GAMBLING TIPS</h3>
          <p>We believe that gambling should always be an enjoyable leisure activity. Remembering these simple tips can help make sure your gambling does not become a problem.</p>
          <ol>
            <li>Gambling should be entertaining and not seen as a way of making money.</li>
            <li>Bet sensibly and never chase losses.</li>
            <li>Only gamble what you can afford to lose.</li>
            <li>Monitor the amount of time you spend playing.</li>
            <li>Balance gambling with other activities. If gambling is your only form of entertainment, think about whether you are still having fun.</li>
            <li>Take regular breaks from gambling. Gambling continuously will cause you to lose track of time and perspective.</li>
            <li>Do not gamble when under the influence of alcohol or any substance/circumstance that may impair your judgment or when you are upset or depressed.</li>
            <li>Think about how much money you spend gambling. You can track your activity in your bet history.</li>
            <li>If you need to talk to someone about a gambling problem, contact our us.</li>
          </ol>

          <h3>UNDERSTANDING YOUR LEVEL OF PLAY</h3>
          <p>Curious about your playing style and want to get an idea of how positive your play is? A quick and easy Responsible Gaming Quiz to help you figure out where you are at with your playing can be found site.</p>

          <h3>Recognising A Problem</h3>
          <p>Below are some common signs and symptoms of compulsive gambling, which may guide your understanding of the problem:</p>
          <ul>
            <li>Gambling to calm nerves, forget worries, or reduce depression;</li>
            <li>Losing interest in other things;</li>
            <li>Talking about, thinking about, or planning to gamble and not doing other activities;</li>
            <li>Lying about gambling habits;</li>
            <li>Gambling alone or gambling more often;</li>
            <li>Getting into arguments about gambling;</li>
            <li>Going without basic needs in order to gamble;</li>
            <li>Needing to gamble more and more money in order to get the desired effect;</li>
            <li>Experiencing health problems related to gambling like lethargy, headaches, anxiety, and depression; or</li>
            <li>Having financial problems caused by gambling.</li>
          </ul>

          <h3>Self-test</h3>
          <p>Based on the signs and symptoms above, ask yourself the following questions:</p>
          <ul>
            <li>Do you feel guilty about the amount of money you spend gambling?</li>
            <li>Do you need to gamble with larger amounts of money to get the same feeling of excitement?</li>
            <li>Do you find it difficult to stop gambling after a loss?</li>
            <li>Does your gambling cause any financial problems for you or your household?</li>
            <li>Does gambling negatively affect your personal relationships, your job or studies?</li>
            <li>Does your gambling cause you any health problems, including stress or anxiety?</li>
            <li>Do you become restless if you are not gambling?</li>
            <li>Do you feel that you might have a gambling problem?</li>
          </ul>
          <p>Did you answer 'yes' to any of the questions? If so, we recommend that you dial our toll-free responsible gambling helpline and speak to a counsellor. They are trained in dealing with problem gambling issues and are available to talk to you 24 hours a day, 7 days a week.</p>

          <h3>4 SELF-EXCLUSION</h3>
          <p>For a few customers gambling might become a serious problem. We offer a self-exclusion option that can be easily implemented by a customer's request. To self-exclude from accessing our products, follow the steps below:</p>
          <ol>
            <li>Please contact us and give clear written instructions of the self-exclusion measure and the period of exclusion you would like implemented on your account. We offer the following period(s) of exclusion: 7 days, 1 month, 3 months, 6 months, 1 year, 2 years, 5 years, and permanent exclusion.</li>
            <li>Ensure that in your written request you have provided proof that the mobile number, which is a unique identifier for your account, is registered in your name by the mobile services operator. We retain the right to request you for any such due diligence documents for the purposes of ascertaining proof of account ownership.</li>
            <li>Where the above information and documentation has been received by us, then your account may be suspended within a period of 12 hours;</li>
            <li>Once you send a request for self-exclusion we will endeavor to suspend your account as quickly as possible however any bets placed prior to the suspension of your account shall continue to be in place and any winnings will be credited into your account as soon as the event is settled.</li>
            <li>Once self-excluded, you will not be allowed to register a new account. Where a new account belonging to a self-excluded customer is detected, it will be suspended and closed immediately. Any winning bets in the new account after existing account is self-excluded shall be voided and shall be considered a Prohibited Act under our General Terms and Conditions.</li>
            <li>Our company reserves the right to exclude a customer for a longer period at our discretion. This may include instances where Our company is informed by legitimate sources or the requesting customer has cited addiction issues (e.g. regulators or other authorities, authorized professional organizations, authorized medical professional etc.) that may warrant extension of a customer’s self-exclusion period.</li>
            <li>Where the self-exclusion request is due to addiction or problem gambling, we shall require the customer to provide a written confirmation/notice from a certified medical practitioner, regulator or counsellor proving they have overcome their addiction.</li>
          </ol>

          <h3>5 RE- ACTIVATION OF ACCOUNTS</h3>
          <p>To re-activate your account, you MUST contact us by email after the self-exclusion period has expired in order to re-gain access to the account and be able to place bets.</p>

          <h3>INDEPENDENT PROFESSIONAL HELP</h3>
          <p>Our company commits to provide information on where you, our customers, could seek professional help, support and advice pertaining to gambling problems.</p>
          <p>Our company acknowledges that we are not qualified professional advisers on problem or compulsive gambling related matters and accordingly, we are not in a position to offer professional advice of such nature to customers.</p>

          <h3>7 THIRD PARTY INFORMATION</h3>
          <p>We may receive problem gambler or problem gambling related information concerning our customers from third parties from time to time. Such information will be acted upon only if they are received directly from the following legitimate third parties:</p>
          <ul>
            <li>Regulators or other similar authorities;</li>
            <li>Authorized professional organizations that help and provide support to problem gamblers; or</li>
            <li>The customer’s authorized medical general practitioner.</li>
          </ul>
          <p>Information received from any other third parties will be afforded due consideration but will not be acted upon in isolation.</p>
          <p>Activities of a customer who has been reported as problem gambler by such third parties will be monitored to establish if the person displays any signs of gambling problem.</p>
          <p>Whilst we recognize that information may be provided by such third parties with good intentions and for appropriate reasons, it may not always be the case. Rather than acting solely based on unverified information received, we will undertake appropriate monitoring and assessment of suspected problem gamblers.</p>

          <h3>8 PREVENTING UNDERAGE GAMBLING</h3>
          <p>It is illegal for anyone under the age of 18 to gamble. Our company takes its responsibilities to prevent access by persons under the permitted age very seriously. We make it clear in our Terms and Conditions and in the account registration process that underage gambling is illegal.</p>
          <p>We reserve the right to carry out verification checks to ensure that all account holders are at least 18 years old and may suspend an account until adequate verification is received.</p>
          <p>It is unlawful to allow minors to gamble and we ask our customers to do their part in ensuring that this does not happen. We ask all of our customers, and in fact it is the responsibility of our customers, to ensure that their account is not used for under aged gambling.</p>
          <p>Some suggestions on how to make sure this does not happen are provided below:</p>
          <ul>
            <li>Do not leave your computer unattended when you are logged on to our website.</li>
            <li>Make sure to logout when you leave our website.</li>
            <li>Do not share your Mobile Money account details.</li>
            <li>Do not leave the "Save Password" option enabled.</li>
            <li>Use child protection software.</li>
            <li>Create separate computer profiles for your children.</li>
            <li>If you know a registered user below the lawful age, please contact Customer Services.</li>
          </ul>

          <h3>9 PARENTAL CONTROLS</h3>
          <p>There are a number of third-party applications that parents or guardians can use to monitor or restrict the use of their computer's access to the Internet:</p>
          <ul>
            <li>Net Nanny filtering software protects children from inappropriate web content: <a href="https://www.netnanny.com" target="_blank" rel="noopener noreferrer">www.netnanny.com</a></li>
            <li>CYBER sitter filtering software allowing parents to add their own sites to block: <a href="https://www.cybersitter.com" target="_blank" rel="noopener noreferrer">www.cybersitter.com</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ResponsibleGambling;
